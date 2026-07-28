'use client'

import { MergeUIOptionsStore } from '@/stores/merge-options'
import { ProjectMergeUI } from '@/components/project-merge-ui'

const mergeOptions = new MergeUIOptionsStore()

export default function Home() {
  return (
    <main>
      <section className='text-center'>
        <h1 className='my-8 text-4xl font-semibold text-black min-[550px]:text-5xl dark:text-white'>
          Entry Mergy
        </h1>
        <p>엔트리 작품 / 타이포그래피 작품 병합기</p>
      </section>
      <hr className='mx-5 my-10 border-gray-200 dark:border-gray-800' />
      <section>
        <h2 className='my-6 text-center text-4xl font-medium'>병합하기</h2>
        <ProjectMergeUI
          options={mergeOptions}
          className='m-auto max-w-4xl px-4'
        />
      </section>
    </main>
  )
}
