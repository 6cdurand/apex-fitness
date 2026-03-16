// Body shape goal options with Unsplash fitness photos

export interface BodyShapeOption {
  id: string;
  label: string;
  description: string;
  photo: string;
}

export const MALE_SHAPES: BodyShapeOption[] = [
  {
    id: 'lean',
    label: 'Lean & Toned',
    description: 'Low body fat, defined muscles',
    photo: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'athletic',
    label: 'Athletic',
    description: 'Balanced, functional build',
    photo: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'muscular',
    label: 'Muscular',
    description: 'Big, well-developed physique',
    photo: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'strong',
    label: 'Strong',
    description: 'Powerlifter, raw strength',
    photo: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'big',
    label: 'Big & Powerful',
    description: 'Size + strength combined',
    photo: 'https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=160&h=200&fit=crop&crop=body',
  },
];

export const FEMALE_SHAPES: BodyShapeOption[] = [
  {
    id: 'lean',
    label: 'Lean & Toned',
    description: 'Slim, defined physique',
    photo: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'fit',
    label: 'Fit & Curvy',
    description: 'Toned with natural curves',
    photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'athletic',
    label: 'Athletic',
    description: 'Sporty, strong build',
    photo: 'https://images.unsplash.com/photo-1550345332-09e3ac987658?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'strong',
    label: 'Strong',
    description: 'Powerful, lifting-focused',
    photo: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=160&h=200&fit=crop&crop=body',
  },
  {
    id: 'muscular',
    label: 'Muscular',
    description: 'Well-built, competitive physique',
    photo: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=160&h=200&fit=crop&crop=body',
  },
];
