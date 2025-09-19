declare module 'clipboardy' {
  const clipboard: {
    write(text: string): Promise<void>
    read(): Promise<string>
  }
  export default clipboard
}
