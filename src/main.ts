const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const context = canvas.getContext('2d')!
canvas.width = window.innerWidth
canvas.height = window.innerHeight
context.fillStyle = '#0b0d12'
context.fillRect(0, 0, canvas.width, canvas.height)
