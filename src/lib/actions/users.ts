"use server";

import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "../prisma";

export async function syncUser() {
  try {
    const user = await currentUser();
    if (!user) return null;

    // Use upsert to avoid race condition
    // This will update if exists, create if not exists
    const dbUser = await prisma.user.upsert({
      where: { clerkId: user.id },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.emailAddresses[0].emailAddress,
        phone: user.phoneNumbers[0]?.phoneNumber,
      },
      create: {
        clerkId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.emailAddresses[0].emailAddress,
        phone: user.phoneNumbers[0]?.phoneNumber,
      },
    });

    console.log("✅ User synced:", dbUser.email);
    return dbUser;
  } catch (error) {
    console.error("❌ Error in syncUser server action:", error);
    throw error;
  }
}

/**
 * Ensures user exists in database
 * This should be called before any database operations that require user
 * Uses upsert to prevent race conditions
 */
export async function ensureUserExists() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    // Directly use upsert - no need to check first
    const dbUser = await prisma.user.upsert({
      where: { clerkId: clerkUser.id },
      update: {
        // Update these fields if user already exists
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        email: clerkUser.emailAddresses[0].emailAddress,
        phone: clerkUser.phoneNumbers[0]?.phoneNumber,
      },
      create: {
        // Create with these fields if user doesn't exist
        clerkId: clerkUser.id,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        email: clerkUser.emailAddresses[0].emailAddress,
        phone: clerkUser.phoneNumbers[0]?.phoneNumber,
      },
    });

    return dbUser;
  } catch (error) {
    console.error("❌ Error in ensureUserExists:", error);
    throw error;
  }
}

/**
 * Get current database user with retry logic
 * Useful for server components that need user data
 */
export async function getCurrentDbUser() {
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const user = await ensureUserExists();
      if (user) return user;

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        console.error("❌ Failed to get user after retries:", error);
        throw error;
      }
    }
  }

  return null;
}