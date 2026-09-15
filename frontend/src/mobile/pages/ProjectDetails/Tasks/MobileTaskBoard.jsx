import React from 'react';
import MobileTabs from '../../../components/MobileTabs';
import MobileTaskCard from './MobileTaskCard';
import { TASK_STATUSES } from './mobileTaskModel';

export default function MobileTaskBoard({ tasks, lane, onLaneChange, ...cardProps }) {
    const visible = tasks.filter((task) => task.status === lane);
    return <div className="space-y-3"><MobileTabs segmented label="Task board status" value={lane} onChange={onLaneChange} items={TASK_STATUSES.map((status) => ({ value: status, label: status, count: tasks.filter((task) => task.status === status).length }))} /><div className="space-y-3">{visible.map((task) => <MobileTaskCard key={task.id} task={task} category={task.categoryName} {...cardProps} />)}{visible.length === 0 && <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gh-border">No tasks in {lane}.</p>}</div></div>;
}
