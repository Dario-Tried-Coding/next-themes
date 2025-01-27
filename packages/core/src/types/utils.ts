export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type HasKeys<T> = keyof T extends never ? false : true
export type Keyof<T> = keyof T & string

export type Nullable<T> = T | undefined | null
export type UndefinedOr<T> = T | undefined
export type NullOr<T> = T | null