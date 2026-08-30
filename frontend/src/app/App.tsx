import { MotionConfig } from "framer-motion";

import { ErrorBoundary } from "./ErrorBoundary";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </MotionConfig>
  );
}
