import 'next-auth';

declare module 'next-auth' {
  interface User {
    company_id?: number;
    company_name?: string;
    company_is_system?: boolean;
    token_version?: number;
    /** The person asked to stay signed in on this device (30 days). */
    remember?: boolean;
    company?: {
      id: number;
      name: string;
      is_system: boolean;
    };
  }

  interface Session {
    user: User & {
      id: string;
      company_id: number;
      company_name: string;
      company_is_system: boolean;
      token_version?: number;
      remember?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    company_id?: number;
    company_name?: string;
    company_is_system?: boolean;
    token_version?: number;
    remember?: boolean;
  }
}
