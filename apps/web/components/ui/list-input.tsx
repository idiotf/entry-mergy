import { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import type { ListStore } from '@/stores/list-store'

interface ListInputItemProps {
  i: number
  value: string
  store: ListStore<string>
}

function ListInputItem({
  i,
  value,
  store,
}: ListInputItemProps) {
  const setItem = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => store.set(i, value),
    [i, store]
  )

  const removeItem = useCallback(
    () => store.remove(i),
    [i, store]
  )

  return (
    <li className='flex gap-2'>
      <Input value={value} onChange={setItem} />
      <Button size='icon' variant='ghost' onClick={removeItem}>
        <XIcon />
      </Button>
    </li>
  )
}

export interface ListInputProps {
  store: ListStore<string>
}

export const ListInput = observer(({ store }: ListInputProps) => {
  const addItem = useCallback(
    () => store.add(''),
    [store]
  )

  return (
    <div className='flex gap-2'>
      <Button size='icon' onClick={addItem}>
        <PlusIcon />
      </Button>
      <ul>
        {store.items.map(({ key, value }, i) => (
          <ListInputItem
            key={key}
            i={i}
            value={value}
            store={store}
          />
        ))}
      </ul>
    </div>
  )
})
