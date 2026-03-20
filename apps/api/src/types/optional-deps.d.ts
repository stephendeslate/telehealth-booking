// Type declarations for optional dependencies that may not be installed.
// These are dynamically imported at runtime with fallback behavior.

declare module 'resend' {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: {
        from: string;
        to: string;
        subject: string;
        html: string;
      }): Promise<{ data: { id: string }; error: { message: string } | null }>;
    };
  }
}

declare module 'twilio' {
  function twilio(accountSid: string, authToken: string): {
    messages: {
      create(options: {
        body: string;
        from: string;
        to: string;
      }): Promise<{ sid: string }>;
    };
    video: {
      v1: {
        rooms: {
          create(options: any): Promise<any>;
          (sid: string): {
            update(options: any): Promise<any>;
          };
        };
      };
    };
  };
  namespace twilio {
    namespace jwt {
      namespace AccessToken {
        class VideoGrant {
          room: string;
        }
      }
      class AccessToken {
        constructor(accountSid: string, apiKey: string, apiSecret: string, options?: any);
        addGrant(grant: any): void;
        toJwt(): string;
        identity: string;
      }
    }
  }
  export = twilio;
}

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: any);
    send(command: any): Promise<any>;
  }
  export class PutObjectCommand {
    constructor(input: any);
  }
  export class DeleteObjectCommand {
    constructor(input: any);
  }
  export class GetObjectCommand {
    constructor(input: any);
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(client: any, command: any, options?: any): Promise<string>;
}
