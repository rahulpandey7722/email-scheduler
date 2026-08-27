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

// POST /api/emails/recover - Re-enqueue stuck/queued emails after server crash or restart
emailRouter.post("/recover", emailController.triggerRecovery);

// GET /api/emails/ethereal-info - Fetch active Ethereal sandbox test account credentials & webmail link
emailRouter.get("/ethereal-info", emailController.getEtherealInfo);

export default emailRouter;
