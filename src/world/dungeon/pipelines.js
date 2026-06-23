/**
 * @file Registry mapping a transit-map node's `pipelineId` to its pipeline descriptor, mirroring the
 * stage registry in src/world/generation/pipeline.js. The dungeon runtime looks a descriptor up here
 * when it needs to generate a floor. Add a pipeline here to make it referenceable from a transit map.
 */
import staticTestLevel from '../../../data/pipelines/static-test-level.js';
import randomStaticMaze from '../../../data/pipelines/random-static-maze.js';
import procedural3x3 from '../../../data/pipelines/procedural-3x3.js';

const PIPELINES = {
  [staticTestLevel.id]: staticTestLevel,
  [randomStaticMaze.id]: randomStaticMaze,
  [procedural3x3.id]: procedural3x3,
};

/**
 * Resolves a pipeline id to its descriptor.
 * @throws {Error} On an unknown pipeline id.
 */
export function getPipeline(pipelineId) {
  const pipeline = PIPELINES[pipelineId];
  if (!pipeline) throw new Error(`Unknown pipeline id: "${pipelineId}"`);
  return pipeline;
}
