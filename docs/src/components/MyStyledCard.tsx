import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { CardActionArea, SxProps, Theme } from '@mui/material';

interface MyStyledCardProps {
  title: string;
  description: string;
  imageUrl?: string;
  link?: string;
  sx?: SxProps<Theme>;
}

export default function MyStyledCard({ title, description, imageUrl, link, sx }: MyStyledCardProps): JSX.Element {
  const cardContent = (
    <>
      {imageUrl && (
        <CardMedia
          component="img"
          height="140"
          image={imageUrl}
          alt={title}
        />
      )}
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </>
  );

  return (
    <Card sx={{ maxWidth: 345, margin: 2, ...sx }}>
      {link ? <CardActionArea href={link} target="_blank" rel="noopener noreferrer">{cardContent}</CardActionArea> : cardContent}
    </Card>
  );
}