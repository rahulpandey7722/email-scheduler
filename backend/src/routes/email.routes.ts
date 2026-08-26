import { Router } from "express";
import { emailController, createEmailSchema } from "../controllers/email.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";

const emailRouter = Router();

// Protect all email schedule routes with JWT verification middleware
emailRouter.use(authMiddleware);

// POST /api/emails - Schedule new email batch
emailRouter.post("/", validateBody(createEmailSchema), emailController.createSchedule);

// GET /api/emails/scheduled - Retrieve active/queued scheduled emails
emailRouter.get("/scheduled", emailController.getScheduled);

// GET /api/emails/sent - Retrieve delivered email history
emailRouter.get("/sent", emailController.getSent);

export default emailRouter;
