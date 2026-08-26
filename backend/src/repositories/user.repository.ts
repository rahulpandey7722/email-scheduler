import { prisma } from "../config/db";

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export const userRepository = {
  /**
   * Find or create user record by Google OAuth sub profile
   */
  async upsertGoogleUser(profile: GoogleProfilePayload) {
    return prisma.user.upsert({
      where: { googleId: profile.googleId },
      update: {
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });
  },

  async findById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  },
};
