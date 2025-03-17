import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Define schema for environment variables
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, { message: "OPENAI_API_KEY is required" }),
  // Add other environment variables as needed
});

// Safe parse the environment variables
const result = envSchema.safeParse(process.env);

// Handle validation errors
if (!result.success) {
  console.error("❌ Invalid environment variables:");
  const errors = result.error.format();
  console.error(errors);
  throw new Error("Invalid environment variables");
}

// Export the validated env object
export const env = result.data;
