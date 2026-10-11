export const hex = (value) => {
    let digits = value.replace('#', '')

    if (digits.length === 3) {
        digits = [...digits].map((digit) => digit + digit).join('')
    }

    return [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16))
}

const linear = (channel) => {
    const value = channel / 255

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export const luminance = (color) => {
    const [red, green, blue] = hex(color).map(linear)

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export const contrast = (first, second) => {
    const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)

    return (lighter + 0.05) / (darker + 0.05)
}
