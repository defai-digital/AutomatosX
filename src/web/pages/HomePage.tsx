/**
 * HomePage Component
 * Landing page for the dashboard
 */

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
} from '@mui/material';
import {
  Assessment as QualityIcon,
  AccountTree as DependencyIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export function HomePage(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome to AutomatosX v2
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Code Intelligence Dashboard - Analyze your codebase quality, dependencies, and more
        </Typography>

        <Grid container spacing={3} sx={{ mt: 4 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <QualityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h5" component="div" gutterBottom>
                  Quality Metrics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View code quality metrics, complexity analysis, and technical debt for your
                  project.
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/quality')}>
                  View Dashboard
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <DependencyIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                <Typography variant="h5" component="div" gutterBottom>
                  Dependency Graph
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Explore your codebase dependencies, find circular dependencies, and understand
                  module relationships.
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/dependencies')}>
                  View Graph
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <CodeIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" component="div" gutterBottom>
                  Code Search
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Search your codebase with full-text search, symbol lookup, and advanced
                  filtering.
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/search')}>
                  Search Code
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default HomePage;
