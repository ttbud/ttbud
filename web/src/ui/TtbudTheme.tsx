import {
  createTheme,
  CssBaseline,
  StyledEngineProvider,
  Theme,
  ThemeProvider,
} from "@mui/material";
import React from "react";

const theme = createTheme({
  palette: {
    primary: {
      main: "#4517D1",
    },
    background: {
      default: "#F5F5DC",
    },
  },
});

declare module "@mui/styles/defaultTheme" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DefaultTheme extends Theme {}
}

const TtbudTheme: React.FC = ({ children }) => {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export default TtbudTheme;
