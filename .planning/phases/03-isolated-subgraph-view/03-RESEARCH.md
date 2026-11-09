# Phase 3 Research: Isolated Connected Subgraph View & Full Graph Reset

## 1. Existing Codebase Analysis
- **Subgraph Computation (`src/components/SpatialViewport.tsx`)**:
  - `computeLinkedSubgraph(focusNodeId, nodes, links)` already computes the exact interconnected neighborhood for any selected node (`MOVIE`, `TV`, `DIRECTOR`, `ACTOR`, `TROPE`, or `COMPOSER`), returning:
    - `focusNode`: The selected `GraphNode`
    - `linkedNodeIds`: `Set<string>` containing the selected node ID, all directly or entity-bridged `MOVIE`/`TV` node IDs, and all shared `DIRECTOR`/`ACTOR`/`TROPE`/`COMPOSER` bridge node IDs
    - `directLinkIds`, `bridgeLinkIds`, and `allIlluminatedLinkIds`: `Set<string>` of all links connecting the isolated subgraph
    - `linkedMedia` and `linkedEntities`: Structured lists with shared connection reasons and match scores
- **Current Rendering Behavior vs. Desired Isolation Behavior**:
  - Currently, in both the 3D WebGL scene (`animate()`) and 2D HTML5 Canvas (`render2D()`), selecting a node only *dims* unconnected nodes (`opacity = 0.14`) and unconnected links (`opacity = 0.04`), leaving all ~80–120 unrelated nodes and hundreds of links visible in the background and still pickable by the 3D raycaster / 2D hit-tester.
  - Furthermore, connected nodes remain at their global constellation coordinates, which can leave them widely separated across the sphere when unrelated nodes are hidden.
- **Solution Architecture**:
  1. **Strict Visibility Isolation in 3D & 2D**:
     - When `selectedNodeId` is active (`selSub.focusNode !== null`), hide all nodes not in `selSub.linkedNodeIds` (`assembly.group.visible = false` in 3D; skip drawing in 2D) and hide all links not in `selSub.allIlluminatedLinkIds` (`entry.line.visible = false` and `entry.beamMesh.visible = false` in 3D; skip drawing in 2D).
     - Restrict 3D `raycaster.intersectObjects` and 2D `findNodeAt` to only test visible nodes in `selSub.linkedNodeIds` when a node is selected, preventing ghost hovers or accidental clicks on hidden nodes.
  2. **Focused Radial Subgraph Layout (3D & 2D)**:
     - Store each node's global home coordinates (`homeX`, `homeY`, `homeZ`).
     - When a node is selected, compute deterministic isolated target coordinates (`isoX`, `isoY`, `isoZ`) for every node in `selSub.linkedNodeIds`:
       - Selected `focusNode` moves smoothly to the origin `(0, 0, 0)`.
       - Connected Collaborator/Theme bridge nodes (`linkedEntities`) arrange in an inner/mid orbital ring (`radius ~ 78`) and connected Films/Series (`linkedMedia`) arrange in an outer orbital ring (`radius ~ 128`) around `(0, 0, 0)`.
       - When selection is cleared/reset, all nodes smoothly spring back to their global constellation coordinates (`homeX`, `homeY`, `homeZ`).
  3. **Comprehensive "Reset Everything" Workflow**:
     - Provide a unified `handleResetEverything` action in `SixDegreesApp.tsx` that clears node selection (`inspectedMediaId`, `activeEntityNode`), focal lock (`focalId`), orbit target (`orbitTargetNodeId`), media/gravity/threshold/category visibility filters, and resets 3D/2D camera orientation.
     - Surface **Reset Everything / Show All Nodes** across:
       - Top-center interactive Isolated View status bar in `SpatialViewport.tsx`
       - Top-left context pill and Connected Nodes HUD panel in `SpatialViewport.tsx`
       - Bottom camera control dock in `SpatialViewport.tsx`
       - Top navigation bar (`TopNavBar.tsx`)
       - `Escape` key shortcut

## 2. Verification Strategy
- `npx tsc --noEmit` must pass with zero TypeScript errors.
- Verify that selecting any Movie, TV Series, Director, Actor, Theme, or Composer in 3D or 2D hides all non-connected nodes and links, arranges the connected subgraph clearly in view, and allows one-click or `Esc` reset back to the full graph.
