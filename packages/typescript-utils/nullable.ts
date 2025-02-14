export type UndefinedOr<T> = T | undefined
export type NullOr<T> = T | null
export type Nullable<T> = UndefinedOr<NullOr<T>>