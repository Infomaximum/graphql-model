import type { IModel } from "./Model";
import Model from "./Model";

export interface IGroup extends IModel {
  /**
   * Возвращает список дочерних моделей
   * @returns {Array<IModel>}
   */
  getItems(): Model[];
}

abstract class Group extends Model implements IGroup {
  public abstract getItems(): Model[];
}

export default Group;
