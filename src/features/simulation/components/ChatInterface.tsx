/**
 * ChatInterface - Legacy export for backward compatibility
 * 
 * This file now serves as a simple re-export of SimulationRouter.
 * The original ChatInterface has been refactored into three focused components:
 * 
 * 1. SimulationRouter.tsx - Routes to appropriate simulation type
 * 2. InteractiveSimulation.tsx - Handles PS/PSS interactive chat stations
 * 3. DocumentSimulation.tsx - Handles Sèche/document analysis stations
 * 
 * This wrapper maintains backward compatibility for any code that imports ChatInterface.
 * 
 * @deprecated Use SimulationRouter directly for new code
 */

import SimulationRouter from "./SimulationRouter";

export default SimulationRouter;
