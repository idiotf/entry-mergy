interface EventLike {
  preventDefault(): void
}

export function preventDefault(event: EventLike) {
  event.preventDefault()
}
