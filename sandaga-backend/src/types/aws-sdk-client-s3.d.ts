declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: Record<string, unknown>)
    send<T = unknown>(command: { input: Record<string, unknown> }): Promise<T>
  }

  export class PutObjectCommand {
    constructor(input: Record<string, unknown>)
    readonly input: Record<string, unknown>
  }
}
