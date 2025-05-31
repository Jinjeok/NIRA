import React from 'react';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// 여기에 원하는 Material Design 테마를 정의합니다.
// 자세한 옵션은 MUI 문서를 참고하세요: https://mui.com/customization/theming/
let theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // 예시: 파란색 계열 (프로젝트에 맞게 수정 가능)
    },
    secondary: {
      main: '#dc004e', // 예시: 분홍색 계열 (프로젝트에 맞게 수정 가능)
    },
    // mode: 'light', // 'light' 또는 'dark' 모드 설정 가능
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
  },
});

theme = responsiveFontSizes(theme); // 반응형 폰트 크기 적용

export default function Root({children}: {children: React.ReactNode}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* MUI의 기본 CSS 스타일을 적용하여 브라우저 간 일관성을 높입니다. */}
      {children}
    </ThemeProvider>
  );
}