
import React, { useState } from 'react';
import { BarChart3, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const DashboardCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-white dark:bg-gh-subtle p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gh-border transition-colors">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gh-muted transition-colors">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gh-text mt-2 transition-colors">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gh-muted mt-4 transition-colors">{subtext}</p>
    </div>
);

const Dashboard = () => {
    return (
        <div className="p-4 space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard
                    title="Total Contract Value"
                    value="$14.2M"
                    subtext="+2.4% vs last month"
                    icon={BarChart3}
                    color="bg-blue-500"
                />
                <DashboardCard
                    title="Active Projects"
                    value="12"
                    subtext="3 critical, 4 delayed"
                    icon={Clock}
                    color="bg-orange-500"
                />
                <DashboardCard
                    title="Pending Approvals"
                    value="8"
                    subtext="Avg wait time: 1.2 days"
                    icon={AlertTriangle}
                    color="bg-yellow-500"
                />
                <DashboardCard
                    title="Quality Score"
                    value="94%"
                    subtext="Top 5% of industry"
                    icon={CheckCircle}
                    color="bg-green-500"
                />
            </div>

            {/* Two Column Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Project Health Table */}
                <div className="lg:col-span-2 bg-white dark:bg-gh-subtle rounded-xl shadow-sm border border-gray-100 dark:border-gh-border p-6 transition-colors">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gh-text mb-4 transition-colors">Project Health Overview</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gh-border transition-colors">
                                    <th className="pb-3 text-sm font-medium text-gray-500 dark:text-gh-muted">Project Name</th>
                                    <th className="pb-3 text-sm font-medium text-gray-500 dark:text-gh-muted">Status</th>
                                    <th className="pb-3 text-sm font-medium text-gray-500 dark:text-gh-muted">Progress</th>
                                    <th className="pb-3 text-sm font-medium text-gray-500 dark:text-gh-muted">Cost Variance</th>
                                    <th className="pb-3 text-sm font-medium text-gray-500 dark:text-gh-muted">Due Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gh-border transition-colors">
                                <tr className="group hover:bg-gray-50 dark:hover:bg-gh-hover transition-colors">
                                    <td className="py-4 text-sm font-medium text-gray-900 dark:text-gh-text transition-colors">Metro Station B2</td>
                                    <td className="py-4"><span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium transition-colors">On Track</span></td>
                                    <td className="py-4 text-sm text-gray-600 dark:text-gh-muted w-1/5 transition-colors">
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-4 text-sm text-green-600 dark:text-green-400 transition-colors">-$12k</td>
                                    <td className="py-4 text-sm text-gray-500 dark:text-gh-muted transition-colors">Dec 2026</td>
                                </tr>
                                <tr className="group hover:bg-gray-50 dark:hover:bg-gh-hover transition-colors">
                                    <td className="py-4 text-sm font-medium text-gray-900 dark:text-gh-text transition-colors">Skyline Tower</td>
                                    <td className="py-4"><span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium transition-colors">Delayed</span></td>
                                    <td className="py-4 text-sm text-gray-600 dark:text-gh-muted w-1/5 transition-colors">
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-red-500 h-2 rounded-full" style={{ width: '42%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-4 text-sm text-red-600 dark:text-red-400 transition-colors">+$450k</td>
                                    <td className="py-4 text-sm text-gray-500 dark:text-gh-muted transition-colors">Aug 2026</td>
                                </tr>
                                <tr className="group hover:bg-gray-50 dark:hover:bg-gh-hover transition-colors">
                                    <td className="py-4 text-sm font-medium text-gray-900 dark:text-gh-text transition-colors">City Bridge Repair</td>
                                    <td className="py-4"><span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium transition-colors">At Risk</span></td>
                                    <td className="py-4 text-sm text-gray-600 dark:text-gh-muted w-1/5 transition-colors">
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '88%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-4 text-sm text-gray-600 dark:text-gh-muted transition-colors">0</td>
                                    <td className="py-4 text-sm text-gray-500 dark:text-gh-muted transition-colors">Mar 2026</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Alerts / Notifications */}
                <div className="bg-white dark:bg-gh-subtle rounded-xl shadow-sm border border-gray-100 dark:border-gh-border p-6 transition-colors">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gh-text mb-4 transition-colors">Critical Alerts</h2>
                    <div className="space-y-4">
                        <div className="flex items-start p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30 transition-colors">
                            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 mr-3" />
                            <div>
                                <h4 className="text-sm font-semibold text-red-800 dark:text-red-400">Safety Incident Reported</h4>
                                <p className="text-xs text-red-600 dark:text-red-500 mt-1">Site B - Fall hazard detected. Investigation required immediately.</p>
                            </div>
                        </div>
                        <div className="flex items-start p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-100 dark:border-yellow-900/30 transition-colors">
                            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 mr-3" />
                            <div>
                                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">Material Delivery Delayed</h4>
                                <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Steel shipment for Skyline Tower delayed by 2 days.</p>
                            </div>
                        </div>
                        <div className="flex items-start p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 transition-colors">
                            <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5 mr-3" />
                            <div>
                                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-400">Inspection Passed</h4>
                                <p className="text-xs text-blue-700 dark:text-blue-500 mt-1">Foundation inspection for Metro Station approved.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
