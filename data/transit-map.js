// The dungeon transit map: which levels exist and how they connect. This is the "coordinator" the
// generation pipeline reserved space for (docs/design/procedural-3x3-dungeon.md, "Protected design
// space") — it assigns each level its identity `(branch, depth)` and pipeline, and wires the stairs
// between floors. The pipeline never decides any of this.
//
// Minimal first cut: a linear 3-floor stack, one distinct pipeline per floor. Named ports
// ('up'/'down') map to the stairs' direction; `dir: 'bidi'` means the stairs can be climbed both
// ways. The general model (exit/enter capabilities, branching, contract validation, a transit-map
// visualizer) is designed in docs/design/dungeon-planner.md but not built yet.
export default {
  start: { node: 'floor-1', port: 'up' },
  nodes: [
    { id: 'floor-1', pipelineId: 'static-test-level',  branch: 0, depth: 0 },
    { id: 'floor-2', pipelineId: 'random-static-maze', branch: 0, depth: 1 },
    { id: 'floor-3', pipelineId: 'procedural-3x3',     branch: 0, depth: 2 },
  ],
  edges: [
    { a: ['floor-1', 'down'], b: ['floor-2', 'up'], dir: 'bidi' },
    { a: ['floor-2', 'down'], b: ['floor-3', 'up'], dir: 'bidi' },
  ],
};
