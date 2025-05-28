import Group, { type IGroup } from "./Group";
import Model from "./Model";

type ObjectWithPrototype = {
  prototype: object;
};

function getDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}

function getIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => b.has(x)));
}

function getPrototypes(obj: object) {
  let proto = obj;
  const result = new Set<object>();

  while (
    proto &&
    proto !== Object.prototype &&
    proto !== Model.prototype &&
    proto !== Group.prototype
  ) {
    result.add(proto);

    proto = Object.getPrototypeOf(proto);
  }

  return result;
}

function getOwnPropertyNames(obj: ObjectWithPrototype) {
  return Object.getOwnPropertyNames(obj.prototype);
}

export function findCollisionsInModelMethods(
  baseModel: typeof Model,
  currentModel: typeof Model
) {
  const prototypesBaseModel = getPrototypes(baseModel);
  const prototypesCurrentModel = getPrototypes(currentModel);

  const modelPrototypeDiff = getDifference(
    prototypesBaseModel,
    prototypesCurrentModel
  );

  const ownPropertyNamesDiff = new Set(
    Array.from(modelPrototypeDiff).reduce<string[]>(
      (acc, v: ObjectWithPrototype) => acc.concat(getOwnPropertyNames(v)),
      []
    )
  );

  const ownPropertyNamesCurrentModel = new Set(
    getOwnPropertyNames(currentModel)
  );

  const intersection = getIntersection(
    ownPropertyNamesCurrentModel,
    ownPropertyNamesDiff
  );

  const modelOwnProperties = new Set([
    ...getOwnPropertyNames(Model),
    ...getOwnPropertyNames(Group),
    "getItems" as const satisfies keyof IGroup,
  ]);

  const result = getDifference(intersection, modelOwnProperties);

  result.size &&
    console.error(
      `В модели ${baseModel.name} пересечение \
полей [${Array.from(result.values()).join(", ")}] \
с моделью ${currentModel.name}, typename= ${currentModel.typename}`
    );
}
