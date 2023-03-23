import { assertSilent, assertSimple } from "@infomaximum/assert";
import get from "lodash.get";
import type TypenameToModel from "./TypenameToModel";

export type TTypenameStatic = string | string[] | null;

type TModelAncestorCriteria = IModel | ((model: IModel) => boolean);

/** Структура, в которой лежат "сырые" данные для модели */
export type TModelStruct = {
  id: number;
  __typename: string;
  [field: string]: any;
};

/** Структура с минимальным набором полей, достаточная для восстановления модели */
export type TModelCompactStruct = {
  id: number | undefined;
  __typename: string;
};

/** Параметры, необходимые для создания модели */
export interface IModelParams {
  /** Структура с серверными данными */
  struct: TModelStruct;

  /** Родительская модель, по отношению к данной */
  parent?: IModel;
}

export interface IModel {
  /** Возращает ID модели */
  getId(): number;

  /** Возвращает отображаемое имя модели */
  getDisplayName(): string | undefined;

  /** Возвращает отображаемое имя модели */
  getDisplay(): string | undefined;

  /** Возвращает собственное имя модели */
  getName(): string | undefined;

  /** Является ли модель выбранной */
  isSelected(): boolean;

  /** Удалена ли модель на сервере */
  isDeleted(): boolean;

  /**
   * Переопределено ли значение внутри модели. Задается сервером если есть дочерний элемент с
   * настройкой, переопределяющей родительскую, но этот элемент скрыт (например находится в
   * "показать ещё")
   */
  isRedefined(): boolean;

  /** Возвращает тип объекта, назначеный сервером (__typename) */
  getTypename(): string;

  /** Возвращает родительскую модель, если она есть.*/
  getParentModel(): IModel | undefined;

  /**
   * Генерирует уникальное для модели имя. Используется как id в javascript-коде, чтобы идентифицировать модели
   * у родителя и, в некоторых случаях, среди всех моделей в системе.
   */
  getInnerName(): string;

  /** Есть ли родительская модель у данной */
  hasAncestor(): boolean;

  /**
   * Возвращает предка у модели.
   * Если передали undefined, то вернет непосредственного родителя
   * Если передали {@link IModel}, то для сравнения будет использован оператор `instanceOf`
   * Если передали функцию, то будет возвращен тот предок, для которого она вернет `true`
   * @param {TModelAncestorCriteria} [criteria]
   */
  getAncestor(criteria?: TModelAncestorCriteria): IModel | undefined;
}

/**
 * Базовый класс для моделей
 * @property {TModelStruct} struct - Структура с серверными данными
 * @property {IModel} parent - Родительская модель
 */
abstract class Model implements IModel {
  /** используется для связывания классов моделей и данных приходящих с сервера */
  public static get typename(): TTypenameStatic | undefined {
    assertSilent(false, `У ${this.name} нет typename в статике`);

    return undefined;
  }

  /** метод для проверки, объекта на принадлежность модели */
  public static isModel = <T = typeof Model>(model: any): model is T =>
    Model?.isPrototypeOf(model);

  protected parent?: Model | undefined;
  protected struct!: TModelStruct;
  protected computedStruct!: Map<string, any>;

  constructor(params: IModelParams) {
    assertSimple(!!params.struct, "Не заданы серверные данные для модели!");

    Object.defineProperty(this, "parent", {
      writable: false,
      enumerable: false,
      value: params.parent,
    });

    Object.defineProperty(this, "struct", {
      writable: false,
      enumerable: false,
      value: params.struct,
    });

    Object.defineProperty(this, "computedStruct", {
      writable: false,
      enumerable: false,
      value: new Map<string, any>(),
    });

    return this;
  }

  //// ***==================================================================================*** ////
  //// ***------------------------------------- Геттеры ------------------------------------*** ////
  //// ***==================================================================================*** ////

  /** Возвращает ID модели */
  public getId(): number {
    const field = "id";

    assertSimple(
      !!this.struct[field],
      `Модели c typename ${this.struct.__typename} не передан id объекта!`
    );

    return this.getNumberField(field, true) as number;
  }

  /** Возвращает отображаемое имя модели */
  public getDisplayName(): string | undefined {
    const displayName = this.getStringField("display_name");

    return displayName || this.getName() || this.getDisplay();
  }

  /** Возвращает отображаемое имя модели */
  public getDisplay(): string | undefined {
    return this.getStringField("display");
  }

  /** Возвращает собственное имя модели */
  public getName(): string | undefined {
    return this.getStringField("name");
  }

  /** Является ли модель выбранной */
  public isSelected(): boolean {
    return this.getBoolField("selected");
  }

  /** Удалена ли модель на сервере */
  public isDeleted(): boolean {
    return this.getBoolField("deleted");
  }

  /**
   * Переопределено ли значение внутри модели. Задается сервером если есть дочерний элемент с
   * настройкой, переопределяющей родительскую, но этот элемент скрыт (например находится в
   * "показать ещё")
   */
  public isRedefined(): boolean {
    return this.getBoolField("redefine");
  }

  /** Возвращает родительскую модель (ту из которой она была создана) , если она есть.*/
  public getParentModel<M extends Model = Model>(): M | undefined {
    return this.parent as M | undefined;
  }

  public getTypename(): string {
    assertSimple(
      !!this.struct.__typename,
      "Модели не передан тип объекта __typename!"
    );

    return this.struct.__typename;
  }

  public getInnerName() {
    return `${this.getTypename()}_${this.getId()}`;
  }

  /** Проверяет наличие родителя у модели */
  public hasAncestor() {
    return !!this.parent;
  }

  public getAncestor(criteria?: TModelAncestorCriteria): IModel | undefined {
    const c: any = criteria;
    let parent = this.getParentModel();

    if (!criteria) {
      return parent;
    }

    while (parent) {
      switch (true) {
        case Model.isModel(criteria): {
          if (parent instanceof c) {
            return parent;
          }
          break;
        }
        case criteria instanceof Function: {
          if (c(parent)) {
            return parent;
          }
          break;
        }
        default:
          assertSimple(false, "Некорректный критерий");
      }

      parent = parent.getParentModel();
    }

    return undefined;
  }

  /** Возвращает минимальную структуру, по которой можно восстановить модель*/
  public getCompactStruct(): TModelCompactStruct {
    return {
      id: this.getId(),
      __typename: this.getTypename(),
    };
  }

  //// ***==================================================================================*** ////
  //// ***--------------------- Получение данных из серверной структуры --------------------*** ////
  //// ***==================================================================================*** ////

  /**
   * Получает числовые значения из сырых данных
   * @param field - поле, которое хранит значение в сырых данных
   * @param checkIsInteger - требовать ли проверку на целочисленность значения
   * @returns числовое значение поля
   */
  protected getNumberField(
    field: string,
    checkIsInteger: boolean = false
  ): number | undefined {
    let value: number | undefined;

    if (!this.isInCache(field)) {
      value = this.parseNumber(get(this.struct, field), field, checkIsInteger);
    }

    return this.cacheValue(value, field);
  }

  /**
   * Получает строковые значения из сырых данных
   * @param field - поле, которое хранит значение в сырых данных
   * @returns строковое значение поля. Если данных с сервера нет, то вернётся пустая
   * строка.
   */
  protected getStringField(field: string): string | undefined {
    let value: string | undefined;

    if (!this.isInCache(field)) {
      value = this.parseString(get(this.struct, field), field);
    }

    return this.cacheValue(value, field);
  }

  /**
   * Получает булевые значения из сырых данных
   * @param field - поле, которое хранит значение в сырых данных
   * @returns булевое значение поля. Если данных с сервера нет, то вернётся false.
   */
  protected getBoolField(field: string): boolean {
    let value: boolean = false;

    if (!this.isInCache(field)) {
      value = this.parseBool(get(this.struct, field), field);
    }

    return this.cacheValue(value, field);
  }

  /**
   * Получает список моделей из сырых данных
   * @param field - поле, которое хранит значение в сырых данных
   * @param typenameToModel - инстанс контейнера с моделями
   * @param itemWrapperField - имя вложенного поля в котором лежат нужные данные
   * @returns список моделей
   */
  protected getListField<M extends Model>(
    field: string,
    typenameToModel: TypenameToModel,
    itemWrapperField?: string
  ): M[] {
    let value: M[] = [];

    if (!this.isInCache(field)) {
      value = this.parseList<TModelStruct[], M>(
        get(this.struct, field),
        typenameToModel,
        field,
        itemWrapperField
      );
    }

    return this.cacheValue(value, field);
  }

  /**
   * Получает модель из сырых данных
   * @param field - имя поля, для которого производится очистка (нужно для отладки)
   * @param typenameToModel - инстанс контейнера с моделями
   */
  protected getModelField<M extends Model>(
    field: string,
    typenameToModel: TypenameToModel
  ): M | undefined {
    let value: M | undefined;

    if (!this.isInCache(field)) {
      value = this.parseModel<M>(get(this.struct, field), typenameToModel);
    }

    return this.cacheValue(value, field);
  }

  protected getEnumField<T>(field: string): T[] {
    let value: T[] = [];

    if (!this.isInCache(field)) {
      value = this.parseEnum<T>(get(this.struct, field), field);
    }

    return this.cacheValue(value, field);
  }

  /** Присутствует ли поле в модели (запрошено ли поле) */
  protected hasField(field: string): boolean {
    return get(this.struct, field) !== undefined;
  }

  /** Есть ли доступ к полю (сервер возвращает null при отсутствии доступа) */
  protected hasAccessToField(field: string): boolean {
    assertSimple(this.hasField(field), `Поле ${field} отсутствует в структуре`);
    return get(this.struct, field) !== null;
  }

  //// ***==================================================================================*** ////
  //// ***------------------------------------- Парсеры ------------------------------------*** ////
  //// ***==================================================================================*** ////

  /**
   * Преобразует входное значение в число
   * @param rawValue - сырые данные
   * @param field - имя поля, для которого производится очистка (нужно для отладки)
   * @param [checkIsInteger=false] - требовать ли проверку на целочисленность значения
   * @returns - обработанное число или undefined, если на вход переданы
   * undefined или null
   */
  protected parseNumber(
    rawValue: any,
    field: string,
    checkIsInteger: boolean = false
  ): number | undefined {
    if (
      typeof rawValue === "number" &&
      !isNaN(rawValue) &&
      isFinite(rawValue)
    ) {
      if (checkIsInteger) {
        // приведение к целому через побитовый сдвиг вправо
        const intValue = rawValue >> 0;

        assertSimple(
          intValue === rawValue,
          `В поле "${field}" модели передано число с плавающей точкой - "${get(
            this.struct,
            field
          )}"!`
        );

        return intValue;
      }

      return rawValue;
    }

    if (
      typeof rawValue === "string" &&
      rawValue[0] &&
      !isNaN(parseInt(rawValue[0], 10))
    ) {
      let localRawValue = rawValue;

      if (~localRawValue.indexOf(",")) {
        localRawValue = localRawValue.replace(",", ".");
      }

      if (checkIsInteger) {
        const intValue = parseInt(localRawValue, 10);
        const floatValue = parseFloat(localRawValue);

        assertSimple(
          intValue === floatValue,
          `В поле "${field}" модели передано число с плавающей точкой - "${get(
            this.struct,
            field
          )}"!`
        );

        return intValue;
      }

      return ~localRawValue.indexOf(".")
        ? parseFloat(localRawValue)
        : parseInt(localRawValue, 10);
    }

    if (rawValue === undefined || rawValue === null) {
      return undefined;
    }

    assertSimple(
      false,
      `В поле "${field}" модели передано значение, неприводимое к числу - "${get(
        this.struct,
        field
      )}"!`
    );
  }

  /**
   * Преобразует входное значение в строку
   * @param rawValue - сырые данные
   * @param field - имя поля, для которого производится очистка (нужно для отладки)
   * @returns - строка с данными. Если с сервера пришело значение null или
   * undefined, то вернётся undefined.
   */
  protected parseString(rawValue: any, field: string): string | undefined {
    if (typeof rawValue === "string") {
      return rawValue;
    }

    if (
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      typeof rawValue === "symbol"
    ) {
      return rawValue.toString();
    }

    if (rawValue === undefined || rawValue === null) {
      return undefined;
    }

    assertSimple(
      false,
      `В поле "${field}" модели передано значение, неприводимое к строке - "${get(
        this.struct,
        field
      )}"!`
    );

    return "";
  }

  protected parseBool(rawValue: unknown, field: string): boolean {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }

    if (typeof rawValue === "string") {
      const value = rawValue.slice(0, 5).toLowerCase();

      if (value === "true") {
        return true;
      }

      if (value === "false") {
        return false;
      }
    }

    if (rawValue === undefined || rawValue === null) {
      return false;
    }

    assertSimple(
      false,
      `В поле "${field}" модели передано значение, неприводимое к булевому - "${get(
        this.struct,
        field
      )}"!`
    );

    return false;
  }

  /**
   * Преобразует входное значение в список моделей
   * @param rawValue - сырые данные
   * @param typenameToModel - инстанс контейнера с моделями
   * @param field - имя поля, для которого производится преобразование (нужно для отладки)
   * @param itemWrapperField - имя вложенного поля в котором лежат нужные данные
   * @returns - список моделей. Если данных с сервера нет, то вернётся пустой массив.
   */
  protected parseList<T extends TModelStruct[], M extends Model>(
    rawValue: T,
    typenameToModel: TypenameToModel,
    field: string,
    itemWrapperField?: string
  ): M[] {
    if (rawValue !== null && typeof rawValue === "object") {
      const value: M[] = [];

      rawValue.forEach((rawValueItem) => {
        let item: TModelStruct;

        if (
          itemWrapperField &&
          rawValueItem &&
          rawValueItem.__typename !== "rest"
        ) {
          const nestedData = get(rawValueItem, itemWrapperField);

          assertSimple(
            nestedData,
            `В данных не найдено поле ${itemWrapperField}`
          );

          const nearbyData = { ...rawValueItem };

          delete nearbyData[itemWrapperField];

          item = { ...nearbyData, ...nestedData };
        } else {
          item = rawValueItem;
        }

        const model = this.parseModel<M>(item, typenameToModel);

        model && value.push(model);
      });

      return value;
    }

    assertSimple(
      false,
      `В поле "${field}" модели передано не итерируемое значение - "${get(
        this.struct,
        field
      )}"!`
    );

    return [];
  }

  /**
   * Преобразует входное значение в модель
   * @param rawValue - сырые данные
   * @param typenameToModel - инстанс контейнера с моделями
   */
  protected parseModel<M extends Model>(
    rawValue: TModelStruct,
    typenameToModel: TypenameToModel
  ): M | undefined {
    let ModelClass: (new (params: IModelParams) => any) | undefined;

    if (rawValue !== null && typeof rawValue === "object") {
      if (rawValue.__typename) {
        ModelClass = typenameToModel.get<any>(rawValue.__typename);
      } else {
        assertSimple(false, "Не найден typename в серверных данных");
      }

      assertSilent(
        !!ModelClass,
        `Нет зарегистрированной модели по typename ${rawValue.__typename}`
      );

      return ModelClass
        ? new ModelClass({
            struct: rawValue,
            parent: this,
          })
        : undefined;
    }
  }

  protected parseEnum<T>(rawValue: T, field: string): T[] {
    if (Array.isArray(rawValue)) {
      return rawValue;
    }

    assertSimple(
      false,
      `В поле "${field}" модели передано не массив - "${get(
        this.struct,
        field
      )}"!`
    );

    return [];
  }

  //// ***==================================================================================*** ////
  //// ***------------------------------- Кэширование данных -------------------------------*** ////
  //// ***==================================================================================*** ////

  /**
   * Кэширует данные
   * @param  value - данные для кэширования
   * @param field - имя поля, данные которого кэшируются
   * @returns закэшированное значение
   */
  protected cacheValue<V>(value: V, field: string): V {
    if (!this.isInCache(field)) {
      this.computedStruct.set(field, value);
    }

    return this.computedStruct.get(field);
  }

  /**
   * Проверяет, есть ли в кэше значение для указанного поля
   * @param field - поле, для которого проверяем кэш
   */
  protected isInCache(field: string): boolean {
    return this.computedStruct.has(field);
  }
}

export default Model;
