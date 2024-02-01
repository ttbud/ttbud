import { CollisionDetection, rectIntersection, closestCenter } from "@dnd-kit/core";

/**
 * TODO: Add droppables to each tray that contain the entire tray, then decide collisions based on that
 */
const ttbudCollisionDetector: CollisionDetection = (args) => {
    const {droppableContainers, droppableRects} = args;
    const rectCollisions = rectIntersection(args);
    //TODO: What to do if over both??
    if (rectCollisions.some(col => col.id === 'character-tray')) {
        const relevantContainers = droppableContainers.filter((container => container.data.current?.origin.containerId === 'character-tray'));
        const relevantRects = new Map(relevantContainers.map(container => [container.id, droppableRects.get(container.id)!]));
        return closestCenter({...args, droppableContainers: relevantContainers, droppableRects: relevantRects})
    }

    if (rectCollisions.some(col => col.id === 'floor-tray')) {
        const relevantContainers = droppableContainers.filter((container => container.data.current?.origin.containerId === 'floor-tray'));
        const relevantRects = new Map(relevantContainers.map(container => [container.id, droppableRects.get(container.id)!]));
        return closestCenter({...args, droppableContainers: relevantContainers, droppableRects: relevantRects})
    }

    return rectCollisions;
}

export default ttbudCollisionDetector;