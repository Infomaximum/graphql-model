import type { TModelStruct } from "./Model";
import Model from "./Model";
import { assertSilent, assertSimple } from "@infomaximum/assert";

type TModel = typeof Model;

/** Хранит в себе все модели по их typename */
export class ModelRegistry {
  private registry: Map<string, TModel> = new Map();

  private fallbacksRegisters = new Set<ModelRegistry>();

  private expandModel(baseModel: TModel, expandingModel: TModel): TModel {
    Object.setPrototypeOf(expandingModel.prototype, baseModel.prototype);

    return expandingModel;
  }

  /**
   * Добавляет в список класс модели по typename
   * @param {string} typename - typename объекта, для которого задаётся класс модели
   * @param {Class} modelClass - класс модели
   * @returns {void}
   */
  protected add<T extends string, K extends TModel>(
    typename: T,
    modelClass: K
  ): void {
    const baseModel = this.registry.get(typename);

    if (baseModel && baseModel === modelClass) {
      assertSilent(
        false,
        `Попытка зарегистрировать уже существующую модель ${modelClass.name} с typename - ${modelClass.typename}`
      );

      return;
    }

    if (!baseModel) {
      this.registry.set(typename, modelClass);
    } else {
      /* защита от ошибки 'Cyclic __proto__ value', возникает когда модель которая пытается 
        расширить другую модель является базовой для расширяемой модели     
      */
      if (modelClass && !modelClass.isPrototypeOf(baseModel)) {
        this.registry.set(typename, this.expandModel(baseModel, modelClass));
      }
    }
  }

  /**
   * Возвращает класс модели по заданному typename
   * @param {string} typename - typename объекта, для которого ищется класс модели
   * @returns {Class} - класс модели
   */
  public get<T extends TModel>(typename: string): T | undefined {
    assertSimple(
      this.has(typename),
      `Модель с typename = "${typename}" не найдена`
    );

    return (this.registry.get(typename) || this.getFromAny<T>(typename)) as
      | T
      | undefined;
  }

  /**
   * Создает новый экземпляр модели по typename
   * @param typename
   * @param struct
   */
  public getModelInstance<T extends TModel>(
    typename: string,
    struct: TModelStruct
  ): InstanceType<T> | null {
    const Clazz: any = this.get<T>(typename);

    if (Model.isPrototypeOf(Clazz)) {
      return new Clazz({ struct }) as InstanceType<T>;
    }

    return null;
  }

  /**
   * Проверяет наличие модели в списке зарегистрированных моделей
   * @param typename - typename объекта, для которого выполняется проверка
   */
  public has(typename: string): boolean {
    return this.registry.has(typename) || this.hasInAny(typename);
  }

  /**
   * Регистрирует модели
   *
   * если `Model.typename -> falsy`, то модель не будет зарегистрирована,
   * такое поведение необходимо для абстрактных или шаблонных классов моделей
   * @param models - список моделей для регистрации
   */
  public registrationModels(models: (typeof Model)[]) {
    models?.forEach((model) => {
      const { typename } = model;

      if (typename) {
        if (Array.isArray(typename)) {
          typename.forEach((t) => this.add(t, model));
        } else {
          this.add(typename, model);
        }
      }
    });
  }

  private hasInAny(typename: string) {
    for (const instance of this.fallbacksRegisters) {
      if (instance.has(typename)) {
        return true;
      }
    }

    return false;
  }

  private getFromAny<T extends TModel>(typename: string): T | undefined {
    for (const instance of this.fallbacksRegisters) {
      if (instance.has(typename)) {
        return instance.get(typename);
      }
    }

    return undefined;
  }

  public extends(modelRegistry: ModelRegistry) {
    this.fallbacksRegisters.add(modelRegistry);

    return this;
  }
}
