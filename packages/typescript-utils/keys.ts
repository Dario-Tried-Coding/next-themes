export type HasKeys<T> = keyof T extends never ? false : true
export type Keyof<T> = keyof T & string