import { makeAutoObservable } from 'mobx'

export interface ListItem<T> {
  key: number
  value: T
}

export class ListStore<T> {
  items: ListItem<T>[] = []
  private cnt = 0

  constructor() {
    makeAutoObservable(this)
  }

  get keys() {
    return this.items.map(({ key }) => key)
  }

  get values() {
    return this.items.map(({ value }) => value)
  }

  add(...value: T[]) {
    this.items.push(...value.map((value) => ({
      key: this.cnt++,
      value,
    })))
  }

  remove(i: number) {
    this.items.splice(i, 1)
  }

  set(i: number, value: T) {
    this.items[i]!.value = value
  }

  setOrder(keys: number[]) {
    const map = new Map<number, ListItem<T>>(this.items.map((item) => [item.key, item]))
    this.items = keys.map((key) => map.get(key)!)
  }
}
