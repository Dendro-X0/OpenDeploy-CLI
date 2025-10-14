import { ImageResponse } from 'next/og'
// Ensure static export compatibility for GitHub Pages
export const dynamic = 'force-static'
export const revalidate = 86400
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon(): ImageResponse {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={32}
        height={32}
        viewBox="0 0 32 32"
        fill="none"
      >
        <rect width="32" height="32" rx="6" fill="#111827" />
        <path d="M8 16h6l2-5 2 10 2-5h4" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    { width: 32, height: 32 }
  )
}
