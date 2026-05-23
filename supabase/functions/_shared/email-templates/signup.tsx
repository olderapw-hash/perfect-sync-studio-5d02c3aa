/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  activationKey?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  activationKey,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu email — Orphea Core</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={brand}>⚔ ORPHEA CORE</Heading>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Confirme seu email</Heading>
        <Text style={text}>
          Obrigado por se cadastrar no{' '}
          <Link href={siteUrl} style={link}>
            <strong>Orphea Core</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          <strong>Seu usuário:</strong>{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
        </Text>
        <Text style={text}>
          Confirme seu endereço de email clicando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verificar Email
        </Button>

        {activationKey ? (
          <>
            <Hr style={divider} />
            <Heading style={h2}>🔑 Chave de ativação do primeiro acesso</Heading>
            <Text style={text}>
              Guarde esta chave em local seguro. Você precisará dela para validar o
              seu <strong>primeiro login</strong> no painel administrativo, e também
              para autorizar cada novo dispositivo que usar para acessar a sua conta.
            </Text>
            <Section style={keyBox}>
              <Text style={keyText}>{activationKey}</Text>
            </Section>
            <Text style={footer}>
              Por segurança, nunca enviamos sua senha por email. Use a senha que você
              cadastrou no momento do registro. Caso a tenha esquecido, utilize a
              opção "Esqueci minha senha" na tela de login.
            </Text>
          </>
        ) : null}

        <Text style={footer}>
          Se você não criou uma conta, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '480px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, padding: '10px 0' }
const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#7F1D1D',
  letterSpacing: '2px',
  margin: '0',
}
const divider = { borderColor: '#C6A15B', margin: '15px 0 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#7F1D1D',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#3a3a3a',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#7F1D1D', textDecoration: 'underline' }
const button = {
  backgroundColor: '#7F1D1D',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '6px',
  padding: '12px 24px',
  textDecoration: 'none',
  border: '1px solid #C6A15B',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
