import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

type TrainingResourceProps = {
  title: string
}

export default function TrainingResource({ title }: TrainingResourceProps) {
  useEffect(() => {
    document.title = `${title} — OIAC Engage`
  }, [title])

  return (
    <div className="page page--training-resource">
      <Link className="training-resource__back" to="/resources">Back to Resources</Link>
      <PageHeader
        eyebrow="Training resource"
        title={title}
        description="This resource will be updated soon."
      />
      <section className="training-resource__notice" aria-label="Resource status">
        <p>We are preparing this training material for OIAC volunteers.</p>
        <Link className="button button--primary" to="/">Back to dashboard</Link>
      </section>
    </div>
  )
}
