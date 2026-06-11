import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import friendsRouter from "./friends";
import postsRouter from "./posts";
import conversationsRouter from "./conversations";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(friendsRouter);
router.use(postsRouter);
router.use(conversationsRouter);
router.use(notificationsRouter);

export default router;
