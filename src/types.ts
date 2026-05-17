export type UserRole = "ADMIN" | "CUSTOMER";

export type AuthUser = {
  id: number;
  name: string;
  phone: string;
  role: UserRole;
  customerId: number | null;
};

export type AppEnv = {
  Variables: {
    user: AuthUser;
    validatedBody: unknown;
    validatedQuery: unknown;
    validatedParams: unknown;
  };
};
