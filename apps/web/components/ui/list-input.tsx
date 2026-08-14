import { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import type { ListStore } from '@/stores/list-store'

interface ListInputItemProps {
  i: number
  value: string
  disabled?: boolean | undefined
  store: ListStore<string>
}

function ListInputItem({ i, value, disabled, store }: ListInputItemProps) {
  const setItem = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) =>
      store.set(i, value),
    [i, store]
  )

  const removeItem = useCallback(() => store.remove(i), [i, store])

  return (
    <li className='flex gap-2'>
      <Input value={value} disabled={disabled} onChange={setItem} />
      <Button disabled={disabled} size='icon' variant='ghost' onClick={removeItem}>
        <XIcon />
      </Button>
    </li>
  )
}

export interface ListInputProps {
  disabled?: boolean | undefined
  store: ListStore<string>
}

export const ListInput = observer(({ disabled, store }: ListInputProps) => {
  const addItem = useCallback(() => store.add(''), [store])

  return (
    <div className='flex gap-2'>
      <Button disabled={disabled} size='icon' onClick={addItem}>
        <PlusIcon />
      </Button>
      <ul>
        {store.items.map(({ key, value }, i) => (
          <ListInputItem
            key={key}
            i={i}
            value={value}
            disabled={disabled}
            store={store}
          />
        ))}
      </ul>
    </div>
  )
})
