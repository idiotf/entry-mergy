import { makeAutoObservable } from 'mobx'

export interface ListItem<T> {
  key: React.Key
  value: T
}

export class ListStore<T> {
  readonly items: ListItem<T>[] = []
  private cnt = 0

  constructor() {
    makeAutoObservable(this)
  }

  add(value: T) {
    this.items.push({
      key: this.cnt++,
      value,
    })
  }

  remove(i: number) {
    this.items.splice(i, 1)
  }

  set(i: number, value: T) {
    this.items[i]!.value = value
  }
}
