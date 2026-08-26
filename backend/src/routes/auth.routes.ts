import { Router } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";
import { userRepository } from "../repositories/user.repository";

const authRouter = Router();
const googleOAuthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Authenticates NextAuth Google id_token or Demo token against Google API/Demo handler,
 * registers/fetches user in DB, and issues backend JWT access token.
 */
authRouter.post("/google", async (req, res, next) => {
  try {
    const { idToken } = req.body;

    let googleId = "demo_google_id_123";
    let email = "demo@example.com";
    let name = "Demo User";
    let avatarUrl: string | undefined = "https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser";

    // If a valid Google ID token is provided and Google Client ID is configured, verify with Google
    if (
      idToken &&
      !idToken.startsWith("demo_token") &&
      env.GOOGLE_CLIENT_ID !== "dummy_google_client_id_dev" &&
      env.GOOGLE_CLIENT_ID !== "your_google_client_id.apps.googleusercontent.com"
    ) {
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken,
          audience: env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (payload) {
          googleId = payload.sub;
          email = payload.email!;
          name = payload.name || "User";
          avatarUrl = payload.picture;
        }
      } catch (err) {
        // Fallback to demo mode if token verification fails locally
      }
    }

    // Upsert user into database (SQLite / Postgres)
    const user = await userRepository.upsertGoogleUser({
      googleId,
      email,
      name,
      avatarUrl,
    });

    // Issue API JWT token valid for 7 days
    const apiToken = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token: apiToken,
      user,
    });
  } catch (error) {
    next(error);
  }
});

export default authRouter;
