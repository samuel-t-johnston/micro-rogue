// The dungeon transit map: which levels exist and how they connect. This is the "coordinator" the
// generation pipeline reserved space for (docs/design/procedural-3x3-dungeon.md, "Protected design
// space") — it assigns each level its identity `(branch, depth)` and pipeline, and wires the stairs
// between floors. The pipeline never decides any of this.
//
// A 3-floor main stack (branch 0) plus one side branch: floor-1's start room has a second down-stair
// (port 'branch1') leading to a four-floor side branch (branch 1) — a large BSP floor, then a walker
// cave floor, then a cellular-automata cave floor, then a composite keep-and-cave floor, each deeper
// than the last. Named ports map to a stair's port; most stairs use their direction ('up'/'down'), but
// a second same-direction stair takes a distinct port (see data/maps/floor-1-a.js and
// docs/howto/dungeon-layout.md). `dir: 'bidi'` means the stairs can be climbed both ways. The general
// model (exit/enter capabilities, contract validation, a transit-map visualizer) is designed in
// docs/design/dungeon-planner.md but not built yet.
export default {
  start: { node: 'floor-1', port: 'up' },
  nodes: [
    { id: 'floor-1', pipelineId: 'static-test-level', branch: 0, depth: 0 },
    { id: 'floor-2', pipelineId: 'random-static-maze', branch: 0, depth: 1 },
    { id: 'floor-3', pipelineId: 'procedural-3x3', branch: 0, depth: 2 },
    // Branch 1: reached from floor-1's second (start-room) down-stair — a BSP floor, then a walker cave
    // floor, then a cellular-automata cave floor, then a composite keep-and-cave floor.
    { id: 'branch-1-floor-1', pipelineId: 'bsp', branch: 1, depth: 0 },
    { id: 'branch-1-floor-2', pipelineId: 'walker', branch: 1, depth: 1 },
    { id: 'branch-1-floor-3', pipelineId: 'ca', branch: 1, depth: 2 },
    { id: 'branch-1-floor-4', pipelineId: 'composite', branch: 1, depth: 3 },
  ],
  edges: [
    { a: ['floor-1', 'down'], b: ['floor-2', 'up'], dir: 'bidi' },
    { a: ['floor-2', 'down'], b: ['floor-3', 'up'], dir: 'bidi' },
    // floor-1's 'branch1' down-stair ↔ the BSP branch floor's up-stair.
    { a: ['floor-1', 'branch1'], b: ['branch-1-floor-1', 'up'], dir: 'bidi' },
    // The BSP floor's down-stair ↔ the walker cave floor's up-stair.
    { a: ['branch-1-floor-1', 'down'], b: ['branch-1-floor-2', 'up'], dir: 'bidi' },
    // The walker floor's down-stair ↔ the CA cave floor's up-stair.
    { a: ['branch-1-floor-2', 'down'], b: ['branch-1-floor-3', 'up'], dir: 'bidi' },
    // The CA floor's down-stair ↔ the composite floor's up-stair.
    { a: ['branch-1-floor-3', 'down'], b: ['branch-1-floor-4', 'up'], dir: 'bidi' },
  ],
};
