// Typage du thème styled-components : `theme` dans les styled components est
// fortement typé sur AppTheme (couleurs des 3 thèmes + échelles partagées).
import 'styled-components'
import type { AppTheme } from './tokens'

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
