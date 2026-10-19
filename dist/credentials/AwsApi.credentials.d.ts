import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class AwsApi implements ICredentialType {
    name: string;
    displayName: string;
    icon: Icon;
    documentationUrl: string;
    properties: INodeProperties[];
}
