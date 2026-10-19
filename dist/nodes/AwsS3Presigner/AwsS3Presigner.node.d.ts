import type { ICredentialsDecrypted, ICredentialTestFunctions, IExecuteFunctions, INodeCredentialTestResult, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class AwsS3Presigner implements INodeType {
    description: INodeTypeDescription;
    methods: {
        credentialTest: {
            awsApiTest(this: ICredentialTestFunctions, credential: ICredentialsDecrypted): Promise<INodeCredentialTestResult>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
