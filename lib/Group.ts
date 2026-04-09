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

  /**
   * Возвращает ID групповой модели.
   * @returns number
   */
  public override getId() {
    return this.getNumberField("id", true) ?? -1;
  }
}

export default Group;
