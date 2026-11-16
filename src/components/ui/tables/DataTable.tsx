/**
 * DataTable - Generic table component for displaying paginated data
 */

import React from 'react'
import { FiChevronLeft, FiChevronRight, FiLoader } from 'react-icons/fi'

export interface ColumnDef<T> {
	id: string
	header: string
	accessorKey?: keyof T
	cell?: (item: T) => React.ReactNode
	width?: string | number
	sortable?: boolean
}

export interface DataTableProps<T> {
	columns: ColumnDef<T>[]
	data: T[]
	isLoading?: boolean
	onRowClick?: (item: T) => void
	currentPage?: number
	pageSize?: number
	totalItems?: number
	onPageChange?: (page: number) => void
	onPageSizeChange?: (size: number) => void
	rowKey?: (item: T, index: number) => string | number
	emptyMessage?: string
	className?: string
}

export function DataTable<T extends Record<string, any>>({
	columns,
	data,
	isLoading = false,
	onRowClick,
	currentPage = 1,
	pageSize = 20,
	totalItems = 0,
	onPageChange,
	onPageSizeChange,
	rowKey = (_, idx) => idx,
	emptyMessage = 'No data available',
	className = '',
}: DataTableProps<T>) {
	const totalPages = Math.ceil(totalItems / pageSize)

	const getCellContent = (item: T, column: ColumnDef<T>) => {
		if (column.cell) {
			return column.cell(item)
		}
		if (column.accessorKey) {
			return String(item[column.accessorKey] ?? '')
		}
		return ''
	}

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			<div className='overflow-x-auto rounded-lg border border-border-soft'>
				<table className='w-full text-sm'>
					<thead className='border-b border-border-soft bg-surface-subtle'>
						<tr>
							{columns.map(column => (
								<th
									key={column.id}
									className='px-4 py-3 text-left font-semibold text-text-secondary'
									style={{ width: column.width }}
								>
									{column.header}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{isLoading ? (
							<tr>
								<td colSpan={columns.length} className='px-4 py-8 text-center'>
									<div className='flex items-center justify-center gap-2 text-text-muted'>
										<FiLoader className='animate-spin' />
										Loading...
									</div>
								</td>
							</tr>
						) : data.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className='px-4 py-8 text-center text-text-muted'
								>
									{emptyMessage}
								</td>
							</tr>
						) : (
							data.map((item, idx) => (
								<tr
									key={rowKey(item, idx)}
									onClick={() => onRowClick?.(item)}
									className={`border-b border-border-soft/50 transition-colors ${
										onRowClick ? 'cursor-pointer hover:bg-surface-subtle' : ''
									}`}
								>
									{columns.map(column => (
										<td key={column.id} className='px-4 py-3 text-text-primary'>
											{getCellContent(item, column)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className='flex items-center justify-between gap-4'>
					<div className='flex items-center gap-2'>
						<label className='text-sm font-medium text-text-secondary'>
							Items per page:
						</label>
						<select
							value={pageSize}
							onChange={e => onPageSizeChange?.(Number(e.target.value))}
							className='rounded-md border border-border-soft bg-surface-card px-2 py-1 text-sm'
						>
							{[10, 20, 50, 100].map(size => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
					</div>

					<div className='flex items-center gap-2'>
						<span className='text-sm text-text-secondary'>
							Page {currentPage} of {totalPages}
						</span>
						<button
							onClick={() => onPageChange?.(currentPage - 1)}
							disabled={currentPage === 1}
							className='flex h-8 w-8 items-center justify-center rounded-md border border-border-soft text-text-secondary disabled:opacity-50'
						>
							<FiChevronLeft />
						</button>
						<button
							onClick={() => onPageChange?.(currentPage + 1)}
							disabled={currentPage === totalPages}
							className='flex h-8 w-8 items-center justify-center rounded-md border border-border-soft text-text-secondary disabled:opacity-50'
						>
							<FiChevronRight />
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
