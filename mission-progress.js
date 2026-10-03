(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChaedaMissionProgress = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function create(steps) {
    return steps.reduce(function (progress, step) {
      progress[step.id] = step.missions.reduce(function (missions, mission) {
        missions[mission.id] = false;
        return missions;
      }, {});
      return progress;
    }, {});
  }

  function complete(progress, stepId, missionId) {
    var missions = progress[stepId];
    if (!missions || !Object.prototype.hasOwnProperty.call(missions, missionId)) return false;
    if (missions[missionId]) return false;
    missions[missionId] = true;
    return true;
  }

  function count(progress, step) {
    return step.missions.filter(function (mission) { return progress[step.id][mission.id]; }).length;
  }

  function isComplete(progress, step) {
    return count(progress, step) === step.missions.length;
  }

  function completedStepCount(progress, steps) {
    return steps.filter(function (step) { return isComplete(progress, step); }).length;
  }

  return {
    create: create,
    complete: complete,
    count: count,
    isComplete: isComplete,
    completedStepCount: completedStepCount,
  };
}));
