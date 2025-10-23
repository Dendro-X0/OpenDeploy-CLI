import { Command } from 'commander'

type Shell = 'bash' | 'zsh' | 'pwsh'

function scriptFor(shell: Shell): string {
  const cmds = [
    'detect','doctor','generate','deploy','logs','open','env','seed','run','init','up','completion'
  ]
  const providers = ['vercel','cloudflare','github']
  const envSub = ['sync','pull','diff','validate']
  if (shell === 'bash') {
    return `# bash completion for opendeploy
_opendeploy_completions() {
  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword 2>/dev/null || { cur=${'$'}COMP_WORDS[${'$'}COMP_CWORD]; prev=${'$'}COMP_WORDS[${'$'}COMP_CWORD-1]; }
  case ${'$'}COMP_CWORD in
    1) COMPREPLY=( $(compgen -W "${cmds.join(' ')}" -- "${'$'}cur") ); return ;;
    2) case ${'$'}prev in
         deploy|logs|open|up) COMPREPLY=( $(compgen -W "${providers.join(' ')}" -- "${'$'}cur") ); return ;;
         env) COMPREPLY=( $(compgen -W "${envSub.join(' ')}" -- "${'$'}cur") ); return ;;
       esac;;
  esac
}
complete -F _opendeploy_completions opendeploy
`
  }
  if (shell === 'zsh') {
    return `#compdef opendeploy
_arguments 
  '1: :->sub' 
  '2: :->arg'
case ${'$'}state in
  sub) _values 'subcommands' ${cmds.map(c=>`'${c}'`).join(' ')};;
  arg) case ${'$'}words[2] in
    deploy|logs|open|up) _values 'providers' ${providers.map(p=>`'${p}'`).join(' ')};;
    env) _values 'envsub' ${envSub.map(s=>`'${s}'`).join(' ')};;
  esac;;
esac
`
  }
  // pwsh (PowerShell) minimal stub
  return `# PowerShell completion (basic) for opendeploy
Register-ArgumentCompleter -CommandName opendeploy -ScriptBlock {
  param(${ '$' }wordToComplete, ${ '$' }commandAst, ${ '$' }cursorPosition)
  ${ '$' }subs = @(${cmds.map(c=>`'${c}'`).join(',')})
  foreach (${ '$' }s in ${ '$' }subs) { if (${ '$' }s -like "${ '$' }wordToComplete*") { [System.Management.Automation.CompletionResult]::new(${ '$' }s, ${ '$' }s, 'ParameterValue', ${ '$' }s) } }
}
`
}

export function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Print shell completion script')
    .option('--shell <name>', 'Shell: bash | zsh | pwsh', 'bash')
    .action(async (opts: { shell?: string }): Promise<void> => {
      const sh = (opts.shell === 'zsh' ? 'zsh' : opts.shell === 'pwsh' ? 'pwsh' : 'bash') as Shell
      process.stdout.write(scriptFor(sh))
    })
}
