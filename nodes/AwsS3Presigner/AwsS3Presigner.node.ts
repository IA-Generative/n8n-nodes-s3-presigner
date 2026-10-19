import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IExecuteFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

interface AwsApiCredentials {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
	region: string;
}

export class AwsS3Presigner implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS S3 Pre-signed URL',
		name: 'awsS3Presigner',
		icon: 'file:s3.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] === "putObject" ? "Upload (PUT)" : "Download (GET)"}}',
		description: 'Generates pre-signed URLs for AWS S3 objects',
		defaults: {
			name: 'AWS S3 Pre-signed URL',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'awsApi',
				required: true,
				testedBy: 'awsApiTest',
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Download Object (GET)',
						value: 'getObject',
						description: 'Generate a URL that allows downloading an object',
						action: 'Generate a presigned download URL',
					},
					{
						name: 'Upload Object (PUT)',
						value: 'putObject',
						description: 'Generate a URL that allows uploading an object',
						action: 'Generate a presigned upload URL',
					},
				],
				default: 'getObject',
			},
			{
				displayName: 'Bucket Name',
				name: 'bucketName',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'my-bucket',
				description: 'Name of the S3 bucket',
			},
			{
				displayName: 'Object Key',
				name: 'objectKey',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'path/to/file.pdf',
				description: 'Key (path/filename) of the object in the bucket',
			},
			{
				displayName: 'Expires In (Seconds)',
				name: 'expiresIn',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 604800,
				},
				default: 3600,
				description:
					'How long the pre-signed URL stays valid, in seconds. Maximum allowed by AWS is 604800 (7 days).',
			},
			{
				displayName: 'Region',
				name: 'region',
				type: 'string',
				default: '',
				placeholder: 'eu-central-1',
				description:
					'AWS region of the bucket. Leave empty to use the region configured in the credentials.',
			},
		],
	};

	methods = {
		credentialTest: {
			async awsApiTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials = credential.data as unknown as AwsApiCredentials;
				try {
					const stsClient = new STSClient({
						region: credentials.region || 'us-east-1',
						credentials: {
							accessKeyId: credentials.accessKeyId,
							secretAccessKey: credentials.secretAccessKey,
							...(credentials.sessionToken ? { sessionToken: credentials.sessionToken } : {}),
						},
					});
					await stsClient.send(new GetCallerIdentityCommand({}));
					return { status: 'OK', message: 'Connection successful' };
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					return { status: 'Error', message: `Credential test failed: ${message}` };
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('awsApi');

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const bucketName = (this.getNodeParameter('bucketName', itemIndex) as string).trim();
				const objectKey = (this.getNodeParameter('objectKey', itemIndex) as string).trim();
				const expiresIn = this.getNodeParameter('expiresIn', itemIndex, 3600) as number;
				const regionOverride = (this.getNodeParameter('region', itemIndex, '') as string).trim();

				if (!bucketName) {
					throw new NodeOperationError(this.getNode(), 'Bucket Name must not be empty', {
						itemIndex,
					});
				}
				if (!objectKey) {
					throw new NodeOperationError(this.getNode(), 'Object Key must not be empty', {
						itemIndex,
					});
				}
				if (!expiresIn || expiresIn < 1 || expiresIn > 604800) {
					throw new NodeOperationError(
						this.getNode(),
						'Expires In must be between 1 and 604800 seconds (7 days)',
						{ itemIndex },
					);
				}

				const region = regionOverride || (credentials.region as string);
				if (!region) {
					throw new NodeOperationError(
						this.getNode(),
						'No region provided. Set it in the node or in the credentials.',
						{ itemIndex },
					);
				}

				const s3Client = new S3Client({
					region,
					credentials: {
						accessKeyId: credentials.accessKeyId as string,
						secretAccessKey: credentials.secretAccessKey as string,
						...(credentials.sessionToken
							? { sessionToken: credentials.sessionToken as string }
							: {}),
					},
				});

				const command =
					operation === 'putObject'
						? new PutObjectCommand({ Bucket: bucketName, Key: objectKey })
						: new GetObjectCommand({ Bucket: bucketName, Key: objectKey });

				const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

				returnData.push({
					json: {
						...items[itemIndex].json,
						presignedUrl,
						presignedUrlDetails: {
							operation: operation === 'putObject' ? 'PUT' : 'GET',
							bucket: bucketName,
							key: objectKey,
							region,
							expiresIn,
							expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
						},
					},
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				const nodeError =
					error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, {
								itemIndex,
								description: 'Failed to generate the pre-signed URL',
							});

				if (this.continueOnFail()) {
					returnData.push({
						json: items[itemIndex].json,
						error: nodeError,
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw nodeError;
			}
		}

		return [returnData];
	}
}
