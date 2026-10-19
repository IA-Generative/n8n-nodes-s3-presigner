"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsApi = void 0;
class AwsApi {
    constructor() {
        this.name = 'awsApi';
        this.displayName = 'AWS API';
        this.icon = 'file:s3.svg';
        this.documentationUrl = 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html';
        this.properties = [
            {
                displayName: 'Access Key ID',
                name: 'accessKeyId',
                type: 'string',
                default: '',
                required: true,
            },
            {
                displayName: 'Secret Access Key',
                name: 'secretAccessKey',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                required: true,
            },
            {
                displayName: 'Session Token',
                name: 'sessionToken',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                description: 'Only required when using temporary credentials (STS)',
            },
            {
                displayName: 'Region',
                name: 'region',
                type: 'string',
                default: 'us-east-1',
                required: true,
                description: 'Default AWS region, e.g. us-east-1. Can be overridden per node.',
            },
        ];
    }
}
exports.AwsApi = AwsApi;
//# sourceMappingURL=AwsApi.credentials.js.map